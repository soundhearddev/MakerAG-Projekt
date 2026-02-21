// meine größe Javascript datei
// 900 zeilen von Settings
(function () {
  "use strict";

  /* ===== KONFIGURATION ===== */
  // keine Ahnung wofür ich eine settings key und background pattern key brauche aber hey..

  const SETTINGS_KEY = "SIGMA_SIGMA_SIGMA";
  const BG_PATTERN_KEY = "bg_pattern_settings";
  //defaults
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

    const theme = {
      primary: rootStyles.getPropertyValue(`--${themeName}-primary`).trim(),
      secondary: rootStyles.getPropertyValue(`--${themeName}-secondary`).trim(),
      accent: rootStyles.getPropertyValue(`--${themeName}-accent`).trim(),
      text: rootStyles.getPropertyValue(`--${themeName}-text`).trim(),
      extra: rootStyles.getPropertyValue(`--${themeName}-extra`).trim(),
    };

    // Fallback zu 'default' wenn Theme nicht gefunden
    // wird auch komplett zuerst geladen damit es wenigsten etwas gibt (auch einfach als fallback)
    // das problem ist jetzt wird man auch immer ganz kurz geflashed beim laden vom blauen
    if (!theme.primary) {
      const fallbackTheme = getThemeFromCSS('default');
      return fallbackTheme;
    }

    return theme;
  }

  // WICHTIG: Theme sofort laden, noch bevor irgendwas anderes lädt
  // das theme war mir das wichtigste, weil es halt das theme ist......
  // und wenn das nicht gut aussieht, dann sieht die seite nicht gut
  // ich habe mir extra hilfe gesucht von Freunden welche sich mit color theorie und so auskennen um die best aussehenden thmes zu suchen <3
  function applyTheme(themeName) {
    // es hollt den theme aus themes.css

    const theme = getThemeFromCSS(themeName);
    const root = document.documentElement;

    // Theme-Variablen setzen
    // es setzt den geladeten theme als --cat theme
    // --cat weil... keine ahnung ich brauchte irgentwas
    root.style.setProperty("--cat-primary", theme.primary);
    root.style.setProperty("--cat-secondary", theme.secondary);
    root.style.setProperty("--cat-accent", theme.accent);
    root.style.setProperty("--cat-text", theme.text);
    root.style.setProperty("--cat-extra", theme.extra);

    // Data-Attribute setzen
    document.body.setAttribute("data-theme", themeName);
    root.setAttribute("data-theme", themeName);

    log("Theme angewendet:", themeName);

    // Event dispatchen
    window.dispatchEvent(
      new CustomEvent("themeChanged", {
        detail: { theme: themeName, colors: theme },
      })
    );
  }

  function handleThemeSelect(themeName) {
    settings.theme = themeName;

    // Theme Options aktualisieren
    document.querySelectorAll(".theme-option").forEach((opt) => {
      opt.classList.toggle("active", opt.dataset.theme === themeName);
    });

    // Live-Vorschau wenn aktiviert
    // wer will bitte keine Live-Vorschaue??
    if (settings.themePreviewMode) {
      applyTheme(themeName);
    }

    log("Theme ausgewählt:", themeName);
  }

  // SOFORTIGES Theme-Laden beim Seitenstart (verhindert Flackern)
  // hat dann aber doch nicht funktioniert...
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



    // Container sichtbar machen
    const container = document.querySelector(".settings-container");
    if (container) {
      setTimeout(() => (container.style.opacity = "1"), 50);
    }

    log("Settings System initialisiert");
  }

  /* ===== EVENT LISTENERS ===== */
  function setupEventListeners() {
    // Navigation Links
    document.querySelectorAll(".settings-nav a").forEach((link) => {
      link.addEventListener("click", handleNavClick);
    });

    // Close Buttons
    document.querySelectorAll(".close-modal").forEach((btn) => {
      btn.addEventListener("click", closeCurrentModal);
    });

    document.querySelectorAll('[data-action="close"]').forEach((btn) => {
      btn.addEventListener("click", closeCurrentModal);
    });

    // Save Buttons
    document.querySelectorAll('[data-action="save"]').forEach((btn) => {
      btn.addEventListener("click", handleSave);
    });

    // Reset Button
    const resetBtn = document.querySelector('[data-action="reset"]');
    if (resetBtn) resetBtn.addEventListener("click", handleReset);

    // Tab Buttons
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // Theme Options
    document.querySelectorAll(".theme-option").forEach((option) => {
      option.addEventListener("click", () => {
        const theme = option.dataset.theme;

        // Nur für Cyberpunk Theme Bestätigung zeigen
        if (theme === 'cyberpunk') {
          showThemeConfirmation(theme);
        } else {
          handleThemeSelect(theme);
        }
      });
    });

    // Input Listeners
    setupInputListeners();

    // Buttons
    const cacheClearBtn = document.getElementById("cache-clear");
    const exportBtn = document.getElementById("export-settings");
    const importBtn = document.getElementById("import-settings");

    if (cacheClearBtn) cacheClearBtn.addEventListener("click", clearCache);
    if (exportBtn) exportBtn.addEventListener("click", exportSettings);
    if (importBtn) importBtn.addEventListener("click", importSettings);

    // Keyboard Shortcuts
    document.addEventListener("keydown", handleKeyboard);

    // Modal Click Outside
    document.querySelectorAll(".settings-modal").forEach((modal) => {
      modal.addEventListener("mousedown", (e) => {
        if (e.target === modal) closeCurrentModal();
      });
    });

    // Drag & Drop
    setupDragAndDrop();
  }

  function setupInputListeners() {
    const inputs = {
      languageSelect: document.getElementById("language-select"),
      autoSave: document.getElementById("auto-save"),
      fontSize: document.getElementById("font-size"),
      fontSizeValue: document.querySelector(".slider-value"),
      animations: document.getElementById("animations"),
      compactMode: document.getElementById("compact-mode"),
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
        document.body.classList.toggle("no-animations", !settings.animations);
      });
    }

    if (inputs.compactMode) {
      inputs.compactMode.addEventListener("change", (e) => {
        settings.compactMode = e.target.checked;
        document.body.classList.toggle("compact-mode", settings.compactMode);
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

    // Menü schließen
    const menuCheckbox = document.getElementById("settings-icon");
    if (menuCheckbox) menuCheckbox.checked = false;

    // Modal öffnen nach kurzer Verzögerung
    setTimeout(
      () => {
        modal.classList.add("active");
        document.body.classList.add("settings-open");

        // Modal zentrieren
        centerModal(modal);

        // Focus auf Close-Button
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

    // Setze Position auf fixed und zentriere
    content.style.position = "fixed";
    content.style.left = "50%";
    content.style.top = "50%";
    content.style.transform = "translate(-50%, -50%)";
    content.style.margin = "0";
  }

  /* ===== TAB SYSTEM ===== */
  function switchTab(tabName) {
    // Tab Buttons aktualisieren
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });

    // Tab Contents aktualisieren
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
      compactMode: document.getElementById("compact-mode"),
      themePreviewMode: document.getElementById("theme-preview-mode"),
      golMode: document.getElementById("golMode"),
      debugMode: document.getElementById("debug-mode"),
    };

    // Werte setzen
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

    // Theme anwenden
    applyTheme(settings.theme);
    handleThemeSelect(settings.theme);

    // Body Classes & Styles
    document.body.style.fontSize = `${settings.fontSize}px`;
    document.body.classList.toggle("no-animations", !settings.animations);
    document.body.classList.toggle("compact-mode", settings.compactMode);

    log("Alle Einstellungen angewendet");
  }

  /* ===== EVENT HANDLERS ===== */
  function handleSave() {
    saveSettings();

    // Theme final anwenden wenn in Theme-Modal
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
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `settings_export_${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      log("Einstellungen exportiert");
      showNotification("Einstellungen exportiert", "success");
    } catch (e) {
      console.error("Fehler beim Export:", e);
      showNotification("Fehler beim Export", "error");
    }
  }

  function importSettings() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

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
    // ESC - Modal schließen
    if (e.key === "Escape" && currentModal) {
      closeCurrentModal();
    }

    // Ctrl+S - Speichern
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
  }

  /* ===== DRAG & DROP ===== */
  // das ist so cool, dass ich das hinbekommen habe
  // es gab viel zu viele bugs und das debuggen war grauenvoll
  // ABER es sieht super gut aus
  function setupDragAndDrop() {
    document.querySelectorAll("[data-drag-handle]").forEach((handle) => {
      handle.addEventListener("mousedown", startDrag);
    });

    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", stopDrag);
  }

  function startDrag(e) {
    if (e.target.classList.contains("close-modal")) return;

    const content = e.currentTarget.closest(".settings-modal-content");
    if (!content) return;

    isDragging = true;

    const rect = content.getBoundingClientRect();

    dragStartX = e.clientX;
    dragStartY = e.clientY;
    modalStartX = rect.left;
    modalStartY = rect.top;

    content.style.position = "fixed";
    content.style.transform = "none";
    content.style.left = `${rect.left}px`;
    content.style.top = `${rect.top}px`;
    content.style.margin = "0";

    e.currentTarget.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
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

    document.body.style.userSelect = "";

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
      toast.style.animation = "slideOutToast 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /* ===== AUTO-SAVE ===== */
  setInterval(() => {
    if (settings.autoSave) {
      saveSettings();
    }
  }, 60000);

  /* ===== WINDOW RESIZE ===== */
  window.addEventListener("resize", () => {
    if (currentModal) {
      centerModal(currentModal);
    }
  });

  /* ===== START ===== */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Export für globale Verwendung
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
        console.warn("Background Patterns Backend nicht verfügbar:", err.message);
        this.renderPatternList([]);
      }
    },

    renderPatternList: function (patterns) {
      const select = document.getElementById("bg-pattern-select");
      if (!select) return;

      select.innerHTML = '<option value="">-- Kein Muster --</option>';

      patterns.forEach((pattern) => {
        const option = document.createElement("option");
        option.value = pattern.path;
        option.textContent = pattern.name;
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
      if (!this.settings.enabled || !this.settings.pattern) {
        document.body.style.backgroundImage = "";
        return;
      }

      document.body.style.backgroundImage = `url("${this.settings.pattern}")`;
      document.body.style.backgroundSize = `${this.settings.size}px`;
      document.body.style.backgroundRepeat = this.settings.repeat;
      document.body.style.backgroundAttachment = "fixed";


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

  // Background Patterns nach kurzer Verzögerung initialisieren
  setTimeout(() => {
    BackgroundPatterns.init();
  }, 100);

  // Export BackgroundPatterns
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
    if (isMoving) return;

    e.preventDefault();
    e.stopPropagation();

    isMoving = true;


    // Berechnung und so
    const padding = 50;
    const boxWidth = box.offsetWidth;
    const boxHeight = box.offsetHeight;

    const maxX = window.innerWidth - boxWidth - padding;
    const maxY = window.innerHeight - boxHeight - padding;

    let randomX, randomY;
    let attempts = 0;

    // Finde eine Position die weit genug vom Cursor entfernt ist
    do {
      randomX = Math.random() * (maxX - padding) + padding;
      randomY = Math.random() * (maxY - padding) + padding;
      attempts++;
    } while (attempts < 5);

    // Setze neue Position
    box.style.position = 'fixed';
    box.style.left = randomX + 'px';
    box.style.top = randomY + 'px';
    box.style.transition = 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)';

    setTimeout(() => {
      isMoving = false;
    }, 350);
  }

  yesBtn.addEventListener('click', UseButton);
  yesBtn.addEventListener('touchstart', UseButton, { passive: false });

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
