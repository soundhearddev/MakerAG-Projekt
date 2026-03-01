// Word Wrap empfohlen
// 900 zeilen von Settings
(function () {
  "use strict";

  /* ===== KONFIGURATION ===== */

  // diese Key wird benutzt um die Einstellungen im localStorage zu speichern. Alle Daten werden als JSON-String unter diesem Key abgelegt.
  // eigentlich sollte man diesen villeicht verschlüsseln oder so, damit nicht jeder der die Seite benutzt einfach die Einstellungen von anderen Leuten sehen und ändern kann, aber da es hier eh nur um ein paar Farben und so geht, ist das denke ich kein großes Problem. Ich meine es wird nie wirlcih sensible Daten gespeichert wie passowort, benutzername, oder email, weil es das man ja nicht braucht so... warum bräuchte man ein login für so eine seite?
  const SETTINGS_KEY = "SIGMA_SIGMA_SIGMA";
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
      const fallbackTheme = getThemeFromCSS('default');
      return fallbackTheme;
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

    // custom Event feuern damit andere JS-Dateien (z.B. GoL, Background) mitbekommen, dass sich das theme geändert hat, ohne dass sie sich direkt kennen müssen
    // JavaScript Events sind damit eine super flexible Möglichkeit zur Kommunikation zwischen verschiedenen Teilen der Anwendung, ohne dass sie direkt voneinander abhängig sind
    window.dispatchEvent(
      new CustomEvent("themeChanged", {
        detail: { theme: themeName, colors: theme },
      })
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

  // IIFE (immediately invoked function expression) läuft sofort beim Script-Load, noch bevor das DOM fertig ist. Ziel: theme schon setzen bevor init() läuft, damit kein sichtbares Flackern zum default-theme entsteht.
  // Das hat so mittelmßig funktioniert. Persönlich habe ich nie ein unterschied bemerkt.
  (function immediateThemeLoad() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (parsed.theme) {
          const theme = getThemeFromCSS(parsed.theme);
          const root = document.documentElement;

          root.style.setProperty("--cat-primary", theme.primary);
          root.style.setProperty("--cat-secondary", theme.secondary);
          root.style.setProperty("--cat-accent", theme.accent);
          root.style.setProperty("--cat-text", theme.text);
          root.style.setProperty("--cat-extra", theme.extra);

          document.body.setAttribute("data-theme", parsed.theme);
          root.setAttribute("data-theme", parsed.theme);

          console.log("Theme sofort geladen:", parsed.theme);
        }
      }
    } catch (e) {
      console.error("Fehler beim sofortigen Theme-Laden:", e);
    }
  })();


  /* ===== INITIALISIERUNG ===== */
  function init() {
    log("Initialisiere Settings System...");
    loadSettings();
    applyAllSettings();
    setupEventListeners();

    const container = document.querySelector(".settings-container");
    if (container) {
      // kleines timeout damit der browser erst rendert, dann opacity animiert
      // ohne timeout würde man die animation nie sehen weil sie schon beim ersten paint fertig wäre
      setTimeout(() => (container.style.opacity = "1"), 50);
    }

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

        // cyberpunk kriegt extra Funktion für halt... Das...
        if (theme === 'cyberpunk') {
          showThemeConfirmation(theme);
        } else {
          handleThemeSelect(theme);
        }
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
      menuCheckbox && menuCheckbox.checked ? 400 : 0
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

  /* ===== TAB SYSTEM ===== */
  function switchTab(tabName) {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });

    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.toggle(
        "active",
        content.dataset.tabContent === tabName
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
    if (inputs.themePreviewMode) inputs.themePreviewMode.checked = settings.themePreviewMode;
    if (inputs.golMode) inputs.golMode.checked = settings.golMode;
    if (inputs.debugMode) inputs.debugMode.checked = settings.debugMode;

    applyTheme(settings.theme);
    handleThemeSelect(settings.theme);

    document.body.style.fontSize = `${settings.fontSize}px`;
    document.body.classList.toggle("no-animations", !settings.animations);

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
  window.handleThemeSelect = handleThemeSelect;

  // =============================================================================
  // BACKGROUND PATTERNS MODULE
  // =============================================================================
  const BackgroundPatterns = {
    settings: {
      enabled: false,
      pattern: "",
      size: 120,
      repeat: "repeat",
    },

    init: async function () {
      log("Background Patterns initialisieren...");

      this.loadSettings();
      await this.loadPatterns();
      this.setupEventListeners();
      this.applyPattern();

      log("Background Patterns initialisiert");
    },

    loadSettings: function () {
      const saved = localStorage.getItem(BG_PATTERN_KEY);
      if (saved) {
        try {
          this.settings = JSON.parse(saved);
          log("BG Pattern Settings geladen:", this.settings);
        } catch (e) {
          console.error("Fehler beim Laden der BG-Pattern-Settings:", e);
        }
      }

      // timeout weil das DOM beim ersten aufruf manchmal noch nicht bereit ist
      // (BackgroundPatterns.init() wird mit setTimeout(100) aufgerufen, aber loadSettings
      // läuft sofort synchron – die inputs sind dann ggf. noch nicht im DOM)
      setTimeout(() => {
        const enabled = document.getElementById("bg-pattern-enabled");
        const size = document.getElementById("bg-pattern-size");
        const repeat = document.getElementById("bg-pattern-repeat");
        const controls = document.getElementById("bg-pattern-controls");

        if (enabled) enabled.checked = this.settings.enabled;

        if (size) {
          size.value = this.settings.size;
          const valueSpan = size.nextElementSibling;
          if (valueSpan) valueSpan.textContent = this.settings.size + "px";
        }

        if (repeat) repeat.value = this.settings.repeat;

        if (controls) {
          controls.style.display = this.settings.enabled ? "block" : "none";
        }
      }, 100);
    },

    saveSettings: function () {
      localStorage.setItem(BG_PATTERN_KEY, JSON.stringify(this.settings));
      log("BG Pattern Settings gespeichert");
    },

    loadPatterns: async function () {
      try {
        // patterns werden vom server geholt (PHP backend gibt JSON zurück)
        const res = await fetch("/api/background.php", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "action=list",
        });

        const response = await res.json();

        if (response.success && response.data && response.data.patterns) {
          log(`${response.data.count} Background Patterns geladen`);
          this.renderPatternList(response.data.patterns);
        } else {
          console.warn("Keine Background Patterns verfügbar:", response.error || "Unbekannter Fehler");
          this.renderPatternList([]);
        }
      } catch (err) {
        // wenn das backend nicht erreichbar ist → leere liste, kein crash
        console.warn("Background Patterns Backend nicht verfügbar:", err.message);
        this.renderPatternList([]);
      }
    },

    renderPatternList: function (patterns) {
      const select = document.getElementById("bg-pattern-select");
      if (!select) return;

      // dropdown neu aufbauen
      select.innerHTML = '<option value="">-- Kein Muster --</option>';

      patterns.forEach((pattern) => {
        const option = document.createElement("option");
        option.value = pattern.path;
        option.textContent = pattern.name;
        // gespeichertes pattern direkt vorauswählen
        if (pattern.path === this.settings.pattern) {
          option.selected = true;
        }
        select.appendChild(option);
      });
    },

    setupEventListeners: function () {
      const enabled = document.getElementById("bg-pattern-enabled");
      const select = document.getElementById("bg-pattern-select");
      const size = document.getElementById("bg-pattern-size");
      const repeat = document.getElementById("bg-pattern-repeat");
      const controls = document.getElementById("bg-pattern-controls");

      if (enabled) {
        enabled.addEventListener("change", (e) => {
          this.settings.enabled = e.target.checked;
          if (controls) {
            controls.style.display = e.target.checked ? "block" : "none";
          }
          this.applyPattern();
          this.saveSettings();
        });
      }

      if (select) {
        select.addEventListener("change", (e) => {
          this.settings.pattern = e.target.value;
          this.applyPattern();
          this.updatePreview();
          this.saveSettings();
        });
      }

      if (size) {
        size.addEventListener("input", (e) => {
          this.settings.size = parseInt(e.target.value);
          const valueSpan = e.target.nextElementSibling;
          if (valueSpan) valueSpan.textContent = this.settings.size + "px";
          this.applyPattern();
          this.updatePreview();
          this.saveSettings();
        });
      }

      if (repeat) {
        repeat.addEventListener("change", (e) => {
          this.settings.repeat = e.target.value;
          this.applyPattern();
          this.updatePreview();
          this.saveSettings();
        });
      }
    },

    applyPattern: function () {
      // wenn deaktiviert oder kein pattern gewählt → background entfernen
      if (!this.settings.enabled || !this.settings.pattern) {
        document.body.style.backgroundImage = "";
        return;
      }

      document.body.style.backgroundImage = `url("${this.settings.pattern}")`;
      document.body.style.backgroundSize = `${this.settings.size}px`;
      document.body.style.backgroundRepeat = this.settings.repeat;
      document.body.style.backgroundAttachment = "fixed"; // pattern scrollt nicht mit dem inhalt

      log("Background Pattern angewendet:", this.settings.pattern);
    },

    updatePreview: function () {
      const preview = document.getElementById("bg-pattern-preview");
      if (!preview) return;

      if (!this.settings.pattern) {
        preview.innerHTML = '<span class="preview-placeholder">Wähle ein Muster aus</span>';
        preview.style.backgroundImage = "";
        return;
      }

      preview.innerHTML = "";
      preview.style.backgroundImage = `url("${this.settings.pattern}")`;
      preview.style.backgroundSize = `${this.settings.size}px`;
      preview.style.backgroundRepeat = this.settings.repeat;
    },

  };

  setTimeout(() => {
    BackgroundPatterns.init();
  }, 100);

  window.BackgroundPatterns = BackgroundPatterns;
})();



// Lustige Geschichte:
// das ganze mit dem Cyberpunk theme Confirm und so, dass man eignetlich nciht das theme auswählen kann und so. Als ich alle Themes nochmal mit ein paar freunden überabeitet habe, welche sich mit Color Theory und so auskennen. haben wir erst natürlcih die jetzigen super guten themes gerwählt aber dazu auch ein theme welches komplett schlimm aussieht. Das ist das Cyberpunk theme. Es hätte kein Sinn gemacht so ein theme reinzubringen, deswegen habe ich später diese Confimation hinzugefügt damit man nicht direkt dieses theme auswhälen kann. Aber also das ganze gestet habe, hatte ich den Fehler, dass der Confirm button nciht funktioniert hat. Es wäre eigentlich ein ziemlich einfacher Fix aber, dann kahm mir die idee mit dem unmöglichen button. Dass man gar nciht so weit kommt und das Theme auswählen kann. Und daraus ist dann das hier geworden.
function showThemeConfirmation(themeName) {
  document.querySelectorAll('.theme-confirm-overlay').forEach(el => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'theme-confirm-overlay';

  overlay.innerHTML = `
        <div class="theme-confirm-box">
            <div class="theme-confirm-title">Cyberpunk Theme</div>
            <div class="theme-confirm-message">
                Bist du sicher, dass du fortfahren möchtest?
            </div>
            <div class="theme-confirm-buttons">
                <button class="theme-confirm-btn theme-confirm-no">Abbrechen</button>
                <button class="theme-confirm-btn theme-confirm-yes">Ja, aktivieren</button>
            </div>
        </div>
    `;

  document.body.appendChild(overlay);

  const yesBtn = overlay.querySelector('.theme-confirm-yes');
  const noBtn = overlay.querySelector('.theme-confirm-no');
  const box = overlay.querySelector('.theme-confirm-box');

  let isMoving = false;

  function UseButton(e) {
    if (isMoving) return; // verhindert dass mehrere moves gleichzeitig laufen

    e.preventDefault();
    e.stopPropagation(); // verhindert dass der click irgendwo anders ankommt

    isMoving = true;

    const padding = 50;
    const boxWidth = box.offsetWidth;
    const boxHeight = box.offsetHeight;

    // maximale position: fenstergröße minus box-größe minus padding damit die box nicht rausfliegt
    const maxX = window.innerWidth - boxWidth - padding;
    const maxY = window.innerHeight - boxHeight - padding;

    let randomX, randomY;
    let attempts = 0;

    // zufällige position innerhalb des erlaubten bereichs berechnen
    // die schleife war ursprünglich geplant um positionen nah am cursor zu vermeiden,
    // aber die bedingung fehlt noch – deswegen macht sie einfach 5 versuche und nimmt den letzten
    do {
      randomX = Math.random() * (maxX - padding) + padding;
      randomY = Math.random() * (maxY - padding) + padding;
      attempts++;
    } while (attempts < 5);

    box.style.position = 'fixed';
    box.style.left = randomX + 'px';
    box.style.top = randomY + 'px';
    // cubic-bezier(0.68, -0.55, 0.265, 1.55) = "back easing" → box überschießt kurz und federt zurück
    box.style.transition = 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)';

    // isMoving lock für 350ms halten damit man den button nicht spammen kann
    // bevor die animation fertig ist
    setTimeout(() => {
      isMoving = false;
    }, 350);
  }

  yesBtn.addEventListener('click', UseButton);
  yesBtn.addEventListener('touchstart', UseButton, { passive: false }); // touch-support für mobile

  noBtn.addEventListener('click', closeConfirmation);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeConfirmation();
  });

  function closeConfirmation() {
    overlay.style.animation = 'fadeOut 0.2s forwards';
    setTimeout(() => {
      overlay.remove();
      delete window.activateCyberpunk; 
    }, 200);
  }
}